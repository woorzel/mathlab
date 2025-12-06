package org.example.repo;

import org.example.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupRepository extends JpaRepository<Group, Long> {
    List<Group> findByTeacher_Id(Long teacherId);
}
