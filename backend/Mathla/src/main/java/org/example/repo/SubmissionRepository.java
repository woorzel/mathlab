package org.example.repo;

import org.example.model.Submission;
import org.example.model.SubmissionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {

    List<Submission> findByStudent_Id(Long studentId);
    List<Submission> findByAssignment_Id(Long assignmentId);

    // Ostatnie zgłoszenie ucznia do danego zadania (np. do /start)
    Optional<Submission> findTopByAssignment_IdAndStudent_IdOrderByIdDesc(Long assignmentId, Long studentId);

    long countByStudent_Id(Long studentId);

    // Kasowania „z uprawnieniami”
    int deleteByIdAndStudent_Id(Long id, Long studentId);
    int deleteByIdAndAssignment_Teacher_Id(Long id, Long teacherId);

    @Modifying
    void deleteByAssignment_Id(Long assignmentId);

    boolean existsByAssignment_IdAndStudent_IdAndStatus(Long assignmentId, Long studentId, SubmissionStatus status);

    @Modifying
    void deleteByAssignment_IdAndStudent_IdAndStatusNot(
            Long assignmentId, Long studentId, SubmissionStatus status);

    @Modifying
    int deleteByAssignment_IdAndStudent_Id(Long assignmentId, Long studentId);

    // ===== NOWE: listowania z dołączonymi relacjami (do panelu oceniania) =====
    @EntityGraph(attributePaths = {"assignment","student"})
    List<Submission> findByAssignment_Teacher_Id(Long teacherId);

    @EntityGraph(attributePaths = {"assignment","student"})
    List<Submission> findByAssignment_Teacher_IdOrderByIdDesc(Long teacherId);

    @EntityGraph(attributePaths = {"assignment","student"})
    List<Submission> findByStudent_IdOrderByIdDesc(Long studentId);
}
