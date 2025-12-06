package org.example.repo;

import org.example.model.GroupStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface GroupStudentRepository extends JpaRepository<GroupStudent, Long> {

    List<GroupStudent> findByGroup_Id(Long groupId);

    boolean existsByGroup_IdAndStudent_Id(Long groupId, Long studentId);

    @Transactional
    @Modifying
    long deleteByGroup_IdAndStudent_Id(Long groupId, Long studentId);

    // 👇 DODAJ TO:
    List<GroupStudent> findByStudent_Id(Long studentId);

    // 👇 (opcjonalnie) jeśli chcesz usuwać wszystkich z grupy przy jej kasowaniu
    @Transactional
    @Modifying
    long deleteByGroup_Id(Long groupId);

    int countByGroup_Id(Long groupId);
}
