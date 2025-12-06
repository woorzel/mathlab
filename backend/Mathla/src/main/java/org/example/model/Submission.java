package org.example.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity @Table(name = "submissions")
public class Submission {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "assignment_id", nullable = false)
    private Assignment assignment;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "text_answer", columnDefinition = "text")
    private String textAnswer;

    @Column(precision = 4, scale = 2)
    private BigDecimal grade;

    @Column(columnDefinition = "text")
    private String feedback;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(precision = 5, scale = 2)
    private BigDecimal score;                 // ocena (np. 4.50), może być null

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private SubmissionStatus status = SubmissionStatus.DRAFT;  // domyślnie szkic

    @Column(length = 1000)
    private String reviewNote;                // notatka nauczyciela (opcjonalnie)

    // get/set
    public BigDecimal getScore() { return score; }
    public void setScore(BigDecimal score) { this.score = score; }

    public SubmissionStatus getStatus() { return status; }
    public void setStatus(SubmissionStatus status) { this.status = status; }

    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    // gettery/settery
    public Long getId() { return id; }
    public Assignment getAssignment() { return assignment; }
    public void setAssignment(Assignment assignment) { this.assignment = assignment; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public String getTextAnswer() { return textAnswer; }
    public void setTextAnswer(String textAnswer) { this.textAnswer = textAnswer; }
    public BigDecimal getGrade() { return grade; }
    public void setGrade(BigDecimal grade) { this.grade = grade; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;
}
