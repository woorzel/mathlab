package org.example.api;

import org.example.api.dto.CreateProblemRequest;
import org.example.api.dto.ProblemResponse;
import org.example.model.Assignment;
import org.example.model.Problem;
import org.example.model.ProblemFormat;
import org.example.model.User;
import org.example.repo.AssignmentRepository;
import org.example.repo.ProblemRepository;
import org.example.repo.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ProblemController {

    private final ProblemRepository problemRepo;
    private final AssignmentRepository assignmentRepo;
    private final UserRepository userRepo;

    public ProblemController(ProblemRepository problemRepo,
                             AssignmentRepository assignmentRepo,
                             UserRepository userRepo) {
        this.problemRepo = problemRepo;
        this.assignmentRepo = assignmentRepo;
        this.userRepo = userRepo;
    }

    @PostMapping("/problems")
    public ResponseEntity<ProblemResponse> create(@RequestBody CreateProblemRequest req) {
        if (req.assignmentId() == null || req.content() == null || req.content().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        Assignment a = assignmentRepo.findById(req.assignmentId())
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));

        Problem p = new Problem();
        p.setAssignment(a);

        if (req.authorId() != null) {
            User author = userRepo.findById(req.authorId())
                    .orElseThrow(() -> new IllegalArgumentException("Author not found"));
            p.setAuthor(author);
        }

        p.setContent(req.content());
        p.setFormat(req.format() != null ? req.format() : ProblemFormat.MARKDOWN_TEX);

        problemRepo.save(p);
        return ResponseEntity.created(URI.create("/api/problems/" + p.getId()))
                .body(toResponse(p));
    }

    @GetMapping("/assignments/{assignmentId}/problems")
    public List<ProblemResponse> byAssignment(@PathVariable Long assignmentId) {
        return problemRepo.findByAssignment_Id(assignmentId)
                .stream().map(this::toResponse).toList();
    }

    private ProblemResponse toResponse(Problem p) {
        return new ProblemResponse(
                p.getId(),
                p.getAssignment().getId(),
                p.getAuthor() != null ? p.getAuthor().getId() : null,
                p.getContent(),
                p.getFormat() != null ? p.getFormat().name() : null,
                p.getCreatedAt() != null ? p.getCreatedAt().toString() : null
        );
    }
}
