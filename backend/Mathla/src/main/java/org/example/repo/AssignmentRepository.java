package org.example.repo;

import org.example.model.Assignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    // statystyki / listowanie po nauczycielu
    long countByTeacher_Id(Long teacherId);

    List<Assignment> findByTeacher_Id(Long teacherId);
}
