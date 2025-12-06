package org.example.api.dto;

public record ProblemResponse(
        Long id,
        Long assignmentId,
        Long authorId,       // może być null
        String content,
        String format,       // nazwa enuma
        String createdAt
) {}
