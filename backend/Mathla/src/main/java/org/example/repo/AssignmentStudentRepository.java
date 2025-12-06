package org.example.repo;

import org.example.model.AssignmentStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.Optional;

public interface AssignmentStudentRepository extends JpaRepository<AssignmentStudent, Long> {

    boolean existsByAssignment_IdAndStudent_Id(Long assignmentId, Long studentId);

    Optional<AssignmentStudent> findByAssignment_IdAndStudent_Id(Long assignmentId, Long studentId);

    List<AssignmentStudent> findByStudent_Id(Long studentId);

    List<AssignmentStudent> findByAssignment_Id(Long assignmentId);

    // Usuwamy wszystkie linki dla zadania (używane przy kasowaniu zadania)
    @Modifying
    void deleteByAssignment_Id(Long assignmentId);

    // Usuwamy przydział zadania dla pojedynczego ucznia
    @Modifying
    int deleteByAssignment_IdAndStudent_Id(Long assignmentId, Long studentId);
}
