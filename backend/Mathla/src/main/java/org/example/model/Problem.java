package org.example.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "problems")
public class Problem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // do jakiego zadania należy
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Assignment assignment;

    // autor (opcjonalnie)
    @ManyToOne(fetch = FetchType.LAZY)
    private User author;

    // właściwa treść problemu
    @Column(name = "content", columnDefinition = "text", nullable = false)
    private String content;

    // format treści
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProblemFormat format = ProblemFormat.MARKDOWN_TEX;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Assignment getAssignment() { return assignment; }
    public void setAssignment(Assignment assignment) { this.assignment = assignment; }

    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public ProblemFormat getFormat() { return format; }
    public void setFormat(ProblemFormat format) { this.format = format; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
