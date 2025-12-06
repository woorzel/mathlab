// src/main/java/org/example/model/Formula.java
package org.example.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;
import java.time.OffsetDateTime;

@Entity @Table(name = "formulas")
public class Formula {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "problem_id")
    private Problem problem;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "submission_id")
    private Submission submission;

    @Column(name = "raw_input", nullable = false, columnDefinition = "text")
    private String rawInput;

    @Enumerated(EnumType.STRING)
    @Column(name = "input_type", nullable = false, columnDefinition = "formula_input")
    @JdbcType(PostgreSQLEnumJdbcType.class)   // ← kluczowe dla PG enum
    private FormulaInput inputType;

    @Column(name = "mathml", nullable = false, columnDefinition = "text")
    private String mathml;

    @Column(name = "speech_text", columnDefinition = "text")
    private String speechText;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();




    // gettery/settery
    public Long getId() { return id; }
    public Problem getProblem() { return problem; }
    public void setProblem(Problem problem) { this.problem = problem; }
    public Submission getSubmission() { return submission; }
    public void setSubmission(Submission submission) { this.submission = submission; }
    public String getRawInput() { return rawInput; }
    public void setRawInput(String rawInput) { this.rawInput = rawInput; }
    public FormulaInput getInputType() { return inputType; }
    public void setInputType(FormulaInput inputType) { this.inputType = inputType; }
    public String getMathml() { return mathml; }
    public void setMathml(String mathml) { this.mathml = mathml; }
    public String getSpeechText() { return speechText; }
    public void setSpeechText(String speechText) { this.speechText = speechText; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
