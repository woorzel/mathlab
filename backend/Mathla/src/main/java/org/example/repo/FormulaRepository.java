package org.example.repo;

import org.example.model.Formula;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FormulaRepository extends JpaRepository<Formula, Long> {
    List<Formula> findBySubmission_Id(Long submissionId);
    void deleteBySubmission_Id(Long submissionId);

    List<Formula> findByProblem_Id(Long problemId);
    long countBySubmission_Student_Id(Long studentId);
}
