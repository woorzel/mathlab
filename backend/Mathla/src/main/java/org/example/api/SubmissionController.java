package org.example.api;

import org.example.api.dto.CreateSubmissionRequest;
import org.example.api.dto.GradeMissingRequest;
import org.example.api.dto.GradeSubmissionRequest;
import org.example.api.dto.SubmissionResponse;
import org.example.api.dto.UpdateSubmissionRequest;
import org.example.model.Assignment;
import org.example.model.AssignmentStudent;
import org.example.model.Submission;
import org.example.model.SubmissionStatus;
import org.example.model.User;
import org.example.repo.AssignmentRepository;
import org.example.repo.AssignmentStudentRepository;
import org.example.repo.FormulaRepository;
import org.example.repo.SubmissionRepository;
import org.example.repo.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.Objects;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/submissions")
public class SubmissionController {

    private final SubmissionRepository submissionRepo;
    private final AssignmentRepository assignmentRepo;
    private final UserRepository userRepo;
    private final FormulaRepository formulaRepo;
    private final AssignmentStudentRepository assignRepo;

    public SubmissionController(SubmissionRepository submissionRepo,
                                AssignmentRepository assignmentRepo,
                                UserRepository userRepo,
                                FormulaRepository formulaRepo,
                                AssignmentStudentRepository assignRepo) {
        this.submissionRepo = submissionRepo;
        this.assignmentRepo = assignmentRepo;
        this.userRepo = userRepo;
        this.formulaRepo = formulaRepo;
        this.assignRepo = assignRepo;
    }

    private static String displayName(User u) {
        if (u == null) return null;
        String n = u.getName() == null ? "" : u.getName().trim();
        if (!n.isBlank()) return n;
        return u.getEmail() != null ? u.getEmail() : ("#" + u.getId());
    }

    private SubmissionResponse toDto(Submission s) {
        var a = s.getAssignment();
        var u = s.getStudent();

        return new SubmissionResponse(
                s.getId(),
                a != null ? a.getId() : null,
                a != null ? a.getTitle() : null,
                u != null ? u.getId() : null,
                displayName(u),
                s.getTextAnswer(),
                s.getScore() == null ? null : s.getScore().toPlainString(), // BigDecimal → String
                s.getStatus() == null ? null : s.getStatus().name(),
                s.getCreatedAt() == null ? null : s.getCreatedAt().toString(),
                s.getReviewNote()
        );
    }

    /* ====== POMOCNICZE ====== */

    /** Termin efektywny: per-uczeń (AssignmentStudent.dueAt) → globalny (Assignment.dueAt) → null (bez terminu). */
    private OffsetDateTime effectiveDueAt(Long assignmentId, Long studentId) {
        if (assignmentId == null || studentId == null) return null;
        Assignment a = assignmentRepo.findById(Objects.requireNonNull(assignmentId)).orElseThrow();
        Optional<AssignmentStudent> linkOpt = assignRepo.findByAssignment_IdAndStudent_Id(Objects.requireNonNull(assignmentId), Objects.requireNonNull(studentId));
        if (linkOpt.isPresent() && linkOpt.get().getDueAt() != null) return linkOpt.get().getDueAt();
        return a.getDueAt();
    }

    private boolean isAfterNow(OffsetDateTime dt) {
        return dt != null && OffsetDateTime.now().isAfter(dt);
    }

    private void assertAssigned(Long assignmentId, Long studentId) {
        if (assignmentId == null || studentId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "IDS_REQUIRED");
        }
        if (!assignRepo.existsByAssignment_IdAndStudent_Id(Objects.requireNonNull(assignmentId), Objects.requireNonNull(studentId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_ASSIGNED");
        }
    }

    private void assertNotPastDeadline(Long assignmentId, Long studentId) {
        OffsetDateTime due = effectiveDueAt(Objects.requireNonNull(assignmentId), Objects.requireNonNull(studentId));
        if (isAfterNow(due)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "DEADLINE_PASSED");
        }
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        Object principal = auth.getPrincipal();
        try {
            // JwtAuthFilter principal record: AuthUser(Long id, String email, String role)
            var idField = principal.getClass().getDeclaredMethod("id");
            Object v = idField.invoke(principal);
            if (v instanceof Long l) return l;
        } catch (Exception ignored) {}
        return null;
    }

    private boolean isTeacher() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        Object principal = auth.getPrincipal();
        try {
            var roleM = principal.getClass().getDeclaredMethod("role");
            Object r = roleM.invoke(principal);
            return "TEACHER".equals(String.valueOf(r));
        } catch (Exception ignored) {}
        return false;
    }

    private void assertTeacherOwner(Long assignmentId, Long teacherId) {
        Assignment a = assignmentRepo.findById(Objects.requireNonNull(assignmentId)).orElseThrow();
        if (a.getTeacher() == null) return; // brak przypisanego nauczyciela → pomijamy
        if (teacherId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "TEACHER_ID_MISSING");
        }
        if (!a.getTeacher().getId().equals(teacherId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_OWNER");
        }
    }

    /** Parsowanie oceny (String → BigDecimal). Akceptuje przecinek jako separator. */
    private BigDecimal parseScore(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        if (t.isEmpty()) return null;
        t = t.replace(',', '.');
        try {
            return new BigDecimal(t);
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_SCORE");
        }
    }

    private BigDecimal parseScoreOrDefault(String raw, BigDecimal def) {
        BigDecimal p = parseScore(raw);
        return p == null ? def : p;
    }

    /* ====== ENDPOINTY ====== */

    // START — zwraca istniejące lub tworzy DRAFT (przed terminem)
    @PostMapping("/start")
    public ResponseEntity<SubmissionResponse> start(@RequestBody CreateSubmissionRequest req) {
        if (req.assignmentId() == null || req.studentId() == null) {
            return ResponseEntity.badRequest().build();
        }
    var a = assignmentRepo.findById(Objects.requireNonNull(req.assignmentId())).orElseThrow();
    var u = userRepo.findById(Objects.requireNonNull(req.studentId())).orElseThrow();

        assertAssigned(a.getId(), u.getId());
        assertNotPastDeadline(a.getId(), u.getId());

        var existing = submissionRepo.findTopByAssignment_IdAndStudent_IdOrderByIdDesc(a.getId(), u.getId());
        if (existing.isPresent()) {
            return ResponseEntity.ok(toDto(existing.get()));
        }

        var s = new Submission();
        s.setAssignment(a);
        s.setStudent(u);
        s.setTextAnswer(req.textAnswer());
        s.setStatus(SubmissionStatus.DRAFT);
        s.setCreatedAt(OffsetDateTime.now());
        submissionRepo.save(s);

    return ResponseEntity.created(Objects.requireNonNull(URI.create("/api/submissions/" + s.getId()))).body(toDto(s));
    }

    @PostMapping
    public ResponseEntity<SubmissionResponse> create(@RequestBody CreateSubmissionRequest req) {
        if (req.assignmentId() == null || req.studentId() == null) {
            return ResponseEntity.badRequest().build();
        }
        assertAssigned(req.assignmentId(), req.studentId());
        assertNotPastDeadline(req.assignmentId(), req.studentId());

    Assignment a = assignmentRepo.findById(Objects.requireNonNull(req.assignmentId())).orElseThrow();
    User u = userRepo.findById(Objects.requireNonNull(req.studentId())).orElseThrow();

        Submission s = new Submission();
        s.setAssignment(a);
        s.setStudent(u);
        s.setTextAnswer(req.textAnswer());
        s.setStatus(SubmissionStatus.DRAFT);
        s.setCreatedAt(OffsetDateTime.now());
        submissionRepo.save(s);

    return ResponseEntity.created(Objects.requireNonNull(URI.create("/api/submissions/" + s.getId()))).body(toDto(s));
    }

    // LISTA — po studentId / assignmentId / teacherId
    @GetMapping
    public List<SubmissionResponse> list(@RequestParam(required = false) Long studentId,
                                         @RequestParam(required = false) Long assignmentId,
                                         @RequestParam(required = false) Long teacherId) {
        List<Submission> list;
        if (studentId != null) {
            list = submissionRepo.findByStudent_IdOrderByIdDesc(studentId);
        } else if (assignmentId != null) {
            list = submissionRepo.findByAssignment_Id(assignmentId);
        } else if (teacherId != null) {
            list = submissionRepo.findByAssignment_Teacher_IdOrderByIdDesc(teacherId);
        } else {
            list = submissionRepo.findAll();
            list.sort(Comparator.comparingLong(Submission::getId).reversed());
        }

        // AUTO-SUBMIT: każdy DRAFT którego termin (efektywny) minął przechodzi na SUBMITTED.
        // Dzięki temu nauczyciel widzi go w kolejce, a uczeń nie może już edytować.
        // Operacja wykonywana przy każdym pobraniu listy – idempotentna.
        boolean anyChanged = false;
        for (Submission s : list) {
            if (s.getStatus() == SubmissionStatus.DRAFT) {
                OffsetDateTime due = effectiveDueAt(s.getAssignment().getId(), s.getStudent().getId());
                if (due != null && OffsetDateTime.now().isAfter(due)) {
                    s.setStatus(SubmissionStatus.SUBMITTED);
                    submissionRepo.save(s);
                    anyChanged = true;
                }
            }
        }
        if (anyChanged) {
            // odśwież listę jeśli coś zmieniliśmy, aby zwrócić aktualny stan
            if (studentId != null) {
                list = submissionRepo.findByStudent_IdOrderByIdDesc(studentId);
            } else if (assignmentId != null) {
                list = submissionRepo.findByAssignment_Id(assignmentId);
            } else if (teacherId != null) {
                list = submissionRepo.findByAssignment_Teacher_IdOrderByIdDesc(teacherId);
            } else {
                list = submissionRepo.findAll();
                list.sort(Comparator.comparingLong(Submission::getId).reversed());
            }
        }

        return list.stream().map(this::toDto).toList();
    }

    // UCZEŃ: aktualizacja odpowiedzi / statusu (np. SUBMITTED) — przed terminem
    @PutMapping("/{id}")
    public SubmissionResponse update(@PathVariable Long id, @RequestBody UpdateSubmissionRequest req) {
        var s = submissionRepo.findById(Objects.requireNonNull(id)).orElseThrow();

        boolean teacher = isTeacher();
        if (!teacher) {
            // Po terminie blokujemy modyfikacje ucznia (brak terminu = brak blokady)
            assertNotPastDeadline(s.getAssignment().getId(), s.getStudent().getId());
        }

        if (req.textAnswer() != null && !teacher) { // tekst zmienia tylko uczeń
            s.setTextAnswer(req.textAnswer());
        }
        if (req.status() != null) {
            SubmissionStatus target;
            try {
                target = SubmissionStatus.valueOf(req.status().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Invalid status: " + req.status());
            }

            if (teacher) {
                // Nauczyciel: dozwolone szybkie przejścia, niezależnie od terminu
                if (target == SubmissionStatus.SUBMITTED && s.getStatus() == SubmissionStatus.GRADED) {
                    s.setStatus(SubmissionStatus.SUBMITTED);
                } else if (target == SubmissionStatus.DRAFT && (s.getStatus() == SubmissionStatus.GRADED || s.getStatus() == SubmissionStatus.SUBMITTED)) {
                    s.setScore(null); // przy retake czyścimy ocenę
                    s.setStatus(SubmissionStatus.DRAFT);
                } else {
                    // inne przejścia nauczyciela: zachowawczo pozwól ustawić jeśli nie łamie logiki
                    s.setStatus(target);
                }
            } else {
                // Uczeń: standardowe ustawienie
                s.setStatus(target);
            }
        }
        submissionRepo.save(Objects.requireNonNull(s));
        return toDto(s);
    }

    // NAUCZYCIEL: OCENA (pozwala DRAFT po terminie przy teacherOverride=true)
    @PutMapping("/{id}/grade")
    public SubmissionResponse grade(@PathVariable Long id, @RequestBody GradeSubmissionRequest req) {
    var s = submissionRepo.findById(Objects.requireNonNull(id)).orElseThrow();

    Long teacherId = req.teacherId() != null ? req.teacherId() : currentUserId();
    assertTeacherOwner(s.getAssignment().getId(), teacherId);

    OffsetDateTime due = effectiveDueAt(s.getAssignment().getId(), s.getStudent().getId());
    boolean pastDue = isAfterNow(due);
    boolean teacherOverride = Boolean.TRUE.equals(req.teacherOverride());
    // RETAKE LOGIC: jeśli teacher przesyła status=DRAFT (z tolerancją spacji/małych liter) – cofamy do poprawy
    String rawStatus = req.status();
    boolean retakeRequested = rawStatus != null && "DRAFT".equalsIgnoreCase(rawStatus.trim());
    // Dodatkowe zabezpieczenie: jeśli status nie został przesłany, ale obecny stan to GRADED,
    // traktuj żądanie bez oceny (score==null) jako retake.
    if (!retakeRequested && rawStatus == null && s.getStatus() == SubmissionStatus.GRADED && req.score() == null) {
        retakeRequested = true;
    }

    boolean canGradeNow =
        retakeRequested
            || s.getStatus() == SubmissionStatus.SUBMITTED
            || s.getStatus() == SubmissionStatus.GRADED /* re-grade allowed */
            || (teacherOverride && pastDue && s.getStatus() == SubmissionStatus.DRAFT);

    if (!canGradeNow) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
            "NEEDS_SUBMITTED or teacherOverride=true after due date for DRAFT (or retake)");
    }

        if (retakeRequested) {
            s.setScore(null);
            if (req.reviewNote() != null) s.setReviewNote(req.reviewNote());
            s.setStatus(SubmissionStatus.DRAFT);
        } else {
            if (req.score() != null) s.setScore(parseScore(req.score()));
            if (req.reviewNote() != null) s.setReviewNote(req.reviewNote());
            s.setStatus(SubmissionStatus.GRADED);
        }
        s.setCreatedAt(s.getCreatedAt() == null ? OffsetDateTime.now() : s.getCreatedAt());

        submissionRepo.save(s);
        return toDto(s);
    }

    // NAUCZYCIEL: ocena „bez zgłoszenia” — tworzy minimalny DRAFT i od razu GRADED
    @PostMapping("/grade-missing")
    public ResponseEntity<SubmissionResponse> gradeMissing(@RequestBody GradeMissingRequest req) {
        if (req.assignmentId() == null || req.studentId() == null) {
            return ResponseEntity.badRequest().build();
        }

        assertTeacherOwner(req.assignmentId(), req.teacherId());
        assertAssigned(req.assignmentId(), req.studentId());

        OffsetDateTime due = effectiveDueAt(req.assignmentId(), req.studentId());
        if (!Boolean.TRUE.equals(req.teacherOverride()) || !isAfterNow(due)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "OVERRIDE_AFTER_DUE_REQUIRED");
        }

    var a = assignmentRepo.findById(Objects.requireNonNull(req.assignmentId())).orElseThrow();
    var u = userRepo.findById(Objects.requireNonNull(req.studentId())).orElseThrow();

        var existingOpt = submissionRepo.findTopByAssignment_IdAndStudent_IdOrderByIdDesc(a.getId(), u.getId());
        Submission s = existingOpt.orElseGet(() -> {
            Submission ns = new Submission();
            ns.setAssignment(a);
            ns.setStudent(u);
            ns.setTextAnswer("");
            ns.setStatus(SubmissionStatus.DRAFT);
            ns.setCreatedAt(OffsetDateTime.now());
            submissionRepo.save(ns);
            return ns;
        });

        // <- tu też: BigDecimal / domyślnie 1
        s.setScore(parseScoreOrDefault(req.score(), BigDecimal.ONE));
        String note = req.reviewNote();
        if (note == null || note.isBlank()) note = "Brak pracy w terminie.";
        s.setReviewNote(note);
        s.setStatus(SubmissionStatus.GRADED);

        submissionRepo.save(s);
    return ResponseEntity.created(Objects.requireNonNull(URI.create("/api/submissions/" + s.getId()))).body(toDto(s));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestParam(required = false) Long studentId) {
        if (studentId != null) {
            var deleted = submissionRepo.deleteByIdAndStudent_Id(id, studentId);
            if (deleted > 0) {
                formulaRepo.deleteBySubmission_Id(id);
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.notFound().build();
        }
        formulaRepo.deleteBySubmission_Id(id);
    submissionRepo.deleteById(Objects.requireNonNull(id));
        return ResponseEntity.noContent().build();
    }
}
