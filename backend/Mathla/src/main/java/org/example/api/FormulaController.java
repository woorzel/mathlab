package org.example.api;

import org.example.api.dto.CreateFormulaRequest;
import org.example.api.dto.FormulaResponse;
import org.example.model.Formula;
import org.example.model.FormulaInput;
import org.example.model.Problem;
import org.example.model.Submission;
import org.example.repo.FormulaRepository;
import org.example.repo.ProblemRepository;
import org.example.repo.SubmissionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/formulas")
public class FormulaController {

    private final FormulaRepository formulaRepo;
    private final ProblemRepository problemRepo;
    private final SubmissionRepository submissionRepo;

    public FormulaController(FormulaRepository formulaRepo,
                             ProblemRepository problemRepo,
                             SubmissionRepository submissionRepo) {
        this.formulaRepo = formulaRepo;
        this.problemRepo = problemRepo;
        this.submissionRepo = submissionRepo;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<FormulaResponse> create(@RequestBody CreateFormulaRequest req) {
        if (req.rawInput() == null || req.rawInput().isBlank()) return ResponseEntity.badRequest().build();
        if (req.mathml() == null || req.mathml().isBlank())     return ResponseEntity.badRequest().build();

        Formula f = new Formula();

        if (req.problemId() != null) {
            Problem p = problemRepo.findById(req.problemId())
                    .orElseThrow(() -> new IllegalArgumentException("Problem not found"));
            f.setProblem(p);
        }
        if (req.submissionId() != null) {
            Submission s = submissionRepo.findById(req.submissionId())
                    .orElseThrow(() -> new IllegalArgumentException("Submission not found"));
            f.setSubmission(s);
        }

        f.setRawInput(req.rawInput());
        f.setInputType(FormulaInput.valueOf(req.inputType().toUpperCase())); // ASCIIMATH | TEX | ...
        f.setMathml(req.mathml());
        f.setSpeechText(req.speechText());

        formulaRepo.save(f);
        return ResponseEntity.created(URI.create("/api/formulas/" + f.getId()))
                .body(new FormulaResponse(f.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!formulaRepo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        formulaRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // Lekki listing pod panel oceniania:
    // zwraca rawInput jako "content" oraz inputType.name() jako "format"
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam Long submissionId) {
        return formulaRepo.findBySubmission_Id(submissionId).stream().map(f -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", f.getId());
            m.put("submissionId", f.getSubmission().getId());
            // pokazujemy surowy zapis (AsciiMath/TeX), żeby nauczyciel widział co wpisał uczeń
            m.put("content", f.getRawInput());
            m.put("format", f.getInputType() == null ? null : f.getInputType().name());
            m.put("createdAt", f.getCreatedAt() == null ? null : f.getCreatedAt().toString());
            return m;
        }).toList();
    }
}
