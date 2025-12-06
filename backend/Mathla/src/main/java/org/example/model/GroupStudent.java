package org.example.model;

import jakarta.persistence.*;

@Entity
@Table(name = "group_students",
        uniqueConstraints = @UniqueConstraint(columnNames = {"group_id","student_id"}))
public class GroupStudent {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private User student;

    // getters/setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
}
