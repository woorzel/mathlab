package org.example.api;

import org.example.api.dto.AssignStudentsRequest;
import org.example.api.dto.AssigneeDto;
import org.example.api.dto.AssignmentResponse;
import org.example.api.dto.CreateAssignmentRequest;
import org.example.api.dto.UpdateAssignmentRequest;
import org.example.api.dto.UpdateAssigneeDueRequest;
import org.example.model.*;
import org.example.repo.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/assignments")
public class AssignmentController {

    private final AssignmentRepository assignmentRepo;
    private final UserRepository userRepo;
    private final AssignmentStudentRepository assignRepo;
    private final SubmissionRepository submissionRepo;
    private final ProblemRepository problemRepo;

    public AssignmentController(
            AssignmentRepository assignmentRepo,
            UserRepository userRepo,
            AssignmentStudentRepository assignRepo,
            SubmissionRepository submissionRepo,
            ProblemRepository problemRepo
    ) {
        this.assignmentRepo = assignmentRepo;
        this.userRepo = userRepo;
        this.assignRepo = assignRepo;
        this.submissionRepo = submissionRepo;
        this.problemRepo = problemRepo;
    }

    /* ===================== tworzenie/listy ===================== */

    @PostMapping
    public ResponseEntity<AssignmentResponse> create(@RequestBody CreateAssignmentRequest req) {
        if (req.teacherId() == null || req.title() == null || req.title().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        User teacher = userRepo.findById(req.teacherId())
                .orElseThrow(() -> new IllegalArgumentException("Teacher not found"));

        Assignment a = new Assignment();
        a.setTeacher(teacher);
        a.setTitle(req.title());
        a.setDescription(req.description());
        if (req.dueAt() != null && !req.dueAt().isBlank()) {
            a.setDueAt(OffsetDateTime.parse(req.dueAt()));
        }
        assignmentRepo.save(a);

        return ResponseEntity.created(URI.create("/api/assignments/" + a.getId()))
                .body(toResponse(a));
    }

    @GetMapping
    public List<AssignmentResponse> list(@RequestParam(required = false) Long teacherId) {
        List<Assignment> list = (teacherId == null)
                ? assignmentRepo.findAll()
                : assignmentRepo.findAll().stream()
                .filter(a -> a.getTeacher().getId().equals(teacherId))
                .collect(Collectors.toList());
        return list.stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public AssignmentResponse get(@PathVariable Long id) {
        Assignment a = assignmentRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        return toResponse(a);
    }

    /* ===================== przydziały / terminy ===================== */

    // kto ma to zadanie – z terminami per-uczeń
    @GetMapping("/{id}/assignees")
    public List<AssigneeDto> assignees(@PathVariable Long id) {
        return assignRepo.findByAssignment_Id(id)
                .stream()
                .map(link -> AssigneeDto.from(link.getStudent(), link.getDueAt()))
                .toList();
    }

    // przydział zadania uczniom (z opcjonalnym terminem dueAt)
    @PostMapping("/{id}/students")
    @Transactional
    public ResponseEntity<Map<String, Object>> assignToStudents(
            @PathVariable Long id,
            @RequestBody AssignStudentsRequest req) {

        var assignment = assignmentRepo.findById(id).orElseThrow();
        OffsetDateTime due = (req.dueAt() != null && !req.dueAt().isBlank())
                ? OffsetDateTime.parse(req.dueAt())
                : null;

        List<Long> dodani = new ArrayList<>();
        List<Long> brak = new ArrayList<>();
        List<Long> zlaRola = new ArrayList<>();
        List<Long> duplikaty = new ArrayList<>();

        for (Long sid : req.studentIds()) {
            var uOpt = userRepo.findById(sid);
            if (uOpt.isEmpty()) { brak.add(sid); continue; }
            var u = uOpt.get();
            if (u.getRole() != UserRole.STUDENT) { zlaRola.add(sid); continue; }
            if (assignRepo.existsByAssignment_IdAndStudent_Id(id, sid)) { duplikaty.add(sid); continue; }

            var link = new AssignmentStudent();
            link.setAssignment(assignment);
            link.setStudent(u);
            link.setDueAt(due);
            assignRepo.save(link);
            dodani.add(sid);
        }

        return ResponseEntity.ok(Map.of(
                "dodani", dodani, "brak", brak, "zlaRola", zlaRola, "duplikaty", duplikaty
        ));
    }

    // zmiana terminu dla jednego ucznia (np. „odesłanie do poprawy” z nowym deadlinem)
    @PutMapping("/{id}/students/{studentId}/due")
    @Transactional
    public ResponseEntity<Void> updateAssigneeDue(@PathVariable Long id,
                                                  @PathVariable Long studentId,
                                                  @RequestBody UpdateAssigneeDueRequest req) {
        var links = assignRepo.findByAssignment_Id(id).stream()
                .filter(l -> l.getStudent().getId().equals(studentId))
                .toList();
        if (links.isEmpty()) return ResponseEntity.notFound().build();

        OffsetDateTime due = (req.dueAt() == null || req.dueAt().isBlank())
                ? null : OffsetDateTime.parse(req.dueAt());
        for (var l : links) { l.setDueAt(due); }
        assignRepo.saveAll(links);
        return ResponseEntity.noContent().build();
    }

    // lista zadań przypisanych uczniowi – z terminem per-uczeń (studentDueAt)
    @GetMapping("/assigned")
    public List<AssignmentResponse> assigned(@RequestParam Long studentId) {
        var links = assignRepo.findByStudent_Id(studentId);
        var ids = links.stream().map(l -> l.getAssignment().getId()).toList();
        var aById = assignmentRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Assignment::getId, x -> x));
        return links.stream()
                .map(l -> toResponseForStudent(aById.get(l.getAssignment().getId()), l.getDueAt()))
                .toList();
    }

    // legacy aliasy (jeśli używane gdzieś w UI)
    @GetMapping("/for-student/{studentId}")
    public List<AssignmentResponse> assignmentsForStudent(@PathVariable Long studentId) {
        return assigned(studentId);
    }

    // cofnięcie przydziału – tylko gdy brak ocenionej pracy
    @DeleteMapping("/{id}/students/{studentId}")
    @Transactional
    public ResponseEntity<Void> unassign(@PathVariable Long id, @PathVariable Long studentId) {
        boolean hasGraded = submissionRepo
                .existsByAssignment_IdAndStudent_IdAndStatus(id, studentId, SubmissionStatus.GRADED);
        if (hasGraded) {
            return ResponseEntity.status(409).build(); // po ocenie – blokujemy cofnięcie
        }

        // usuń tylko nieocenione zgłoszenia (DRAFT/SUBMITTED)
        submissionRepo.deleteByAssignment_IdAndStudent_IdAndStatusNot(id, studentId, SubmissionStatus.GRADED);

        int n = assignRepo.deleteByAssignment_IdAndStudent_Id(id, studentId);
        return n > 0 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    /* ===================== edycja/kasowanie zadania ===================== */

    @PutMapping("/{id}")
    @Transactional
    public AssignmentResponse update(@PathVariable Long id,
                                     @RequestBody UpdateAssignmentRequest req) {
        var a = assignmentRepo.findById(id).orElseThrow();

        if (req.title() != null && !req.title().isBlank()) a.setTitle(req.title());
        if (req.description() != null) a.setDescription(req.description());
        if (req.dueAt() != null && !req.dueAt().isBlank()) {
            a.setDueAt(OffsetDateTime.parse(req.dueAt()));
        } else if (req.dueAt() == null) {
            a.setDueAt(null);
        }
        assignmentRepo.save(a);

        boolean hasProblemChange = (req.problemContent() != null) || (req.problemFormat() != null);
        if (hasProblemChange) {
            Problem p = problemRepo.findFirstByAssignment_IdOrderByIdAsc(a.getId())
                    .orElseGet(() -> {
                        Problem np = new Problem();
                        np.setAssignment(a);
                        np.setFormat(ProblemFormat.MARKDOWN_TEX);
                        return np;
                    });

            if (req.problemContent() != null) p.setContent(req.problemContent());

            if (req.problemFormat() != null) {
                try { p.setFormat(ProblemFormat.valueOf(req.problemFormat())); }
                catch (IllegalArgumentException ignored) {}
            }
            if (p.getFormat() == null) p.setFormat(ProblemFormat.MARKDOWN_TEX);
            problemRepo.save(p);
        }

        return toResponse(a);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        problemRepo.deleteByAssignment_Id(id);
        submissionRepo.deleteByAssignment_Id(id);
        assignRepo.deleteByAssignment_Id(id);
        assignmentRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /* ===================== mapery DTO ===================== */

    // wersja „globalna” (bez kontekstu ucznia)
    private AssignmentResponse toResponse(Assignment a) {
        var pOpt = problemRepo.findFirstByAssignment_IdOrderByIdAsc(a.getId());
        String fmt = pOpt.map(Problem::getFormat).map(Enum::name).orElse(null);
        String content = pOpt.map(Problem::getContent).orElse(null);
        String teacherName = (a.getTeacher().getName() != null && !a.getTeacher().getName().isBlank())
                ? a.getTeacher().getName() : a.getTeacher().getEmail();

        return new AssignmentResponse(
                a.getId(), a.getTeacher().getId(), teacherName, a.getTitle(), a.getDescription(),
                a.getDueAt() == null ? null : a.getDueAt().toString(),
                a.getCreatedAt() == null ? null : a.getCreatedAt().toString(),
                fmt, content, null // studentDueAt – brak w tym wariancie
        );
    }

    // wersja dla widoku ucznia – z per-uczeń due
    private AssignmentResponse toResponseForStudent(Assignment a, OffsetDateTime studentDue) {
        var base = toResponse(a);
        return new AssignmentResponse(
                base.id(), base.teacherId(), base.teacherName(), base.title(), base.description(),
                base.dueAt(), base.createdAt(), base.problemFormat(), base.problemContent(),
                studentDue == null ? null : studentDue.toString()
        );
    }
}
