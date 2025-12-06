package org.example.api.dto;

public record CreateSubmissionRequest(
        Long assignmentId,
        Long studentId,
        String textAnswer
) {}
