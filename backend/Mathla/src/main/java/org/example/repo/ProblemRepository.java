package org.example.repo;

import org.example.model.Problem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProblemRepository extends JpaRepository<Problem, Long> {
    Optional<Problem> findByAssignment_Id(Long assignmentId);
    void  deleteByAssignment_Id(Long assignmentId);
    Optional<Problem> findFirstByAssignment_IdOrderByIdAsc(Long assignmentId);
}
