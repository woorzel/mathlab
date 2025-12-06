// src/main/java/org/example/model/AssignmentStudent.java
package org.example.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(
        name = "assignment_students",
        uniqueConstraints = @UniqueConstraint(columnNames = {"assignment_id","student_id"})
)
public class AssignmentStudent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional=false) @JoinColumn(name="assignment_id")
    private Assignment assignment;
    @Column(name="due_at")                      // ⬅️ NOWE
    private OffsetDateTime dueAt;
    @ManyToOne(optional=false) @JoinColumn(name="student_id")
    private User student;

    @Column(name="created_at", nullable=false)
    private OffsetDateTime createdAt = OffsetDateTime.now();



    public Long getId() { return id; }
    public Assignment getAssignment() { return assignment; }
    public void setAssignment(Assignment assignment) { this.assignment = assignment; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public OffsetDateTime getDueAt() { return dueAt; }
    public void setDueAt(OffsetDateTime dueAt) { this.dueAt = dueAt; }
}
