package org.example.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SubmissionResponse(
        Long id,

        Long assignmentId,
        String assignmentTitle,     // <<— NOWE: tytuł zadania

        Long studentId,
        String studentName,         // <<— NOWE: imię i nazwisko (fallback: e-mail)

        String textAnswer,
        String score,
        String status,
        String createdAt,
        String reviewNote
) {}
