package org.example.api;

import org.example.api.dto.FormulaView;
import org.example.model.Formula;
import org.example.repo.FormulaRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/formulas/view") // <-- inna baza, brak konfliktu
public class FormulaQueryController {
    private final FormulaRepository repo;
    public FormulaQueryController(FormulaRepository repo) { this.repo = repo; }

    @GetMapping
    public List<FormulaView> list(@RequestParam(required = false) Long problemId,
                                  @RequestParam(required = false) Long submissionId) {

        List<Formula> src;
        if (submissionId != null) {
            src = repo.findBySubmission_Id(submissionId);
        } else if (problemId != null) {
            src = repo.findByProblem_Id(problemId);
        } else {
            src = repo.findAll();
        }
        return src.stream().map(this::toView).toList();
    }

    @GetMapping("/{id}")
    public FormulaView one(@PathVariable Long id) {
        Formula f = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Formula not found"));
        return toView(f);
    }

    private FormulaView toView(Formula f) {
        return new FormulaView(
                f.getId(),
                f.getRawInput(),
                f.getInputType() == null ? null : f.getInputType().name(),
                f.getMathml(),
                f.getSpeechText(),
                f.getSubmission() == null ? null : f.getSubmission().getId(),
                f.getProblem() == null ? null : f.getProblem().getId(),
                f.getCreatedAt() == null ? null : f.getCreatedAt().toString()
        );
    }
}
