package org.example.api.dto;

import org.example.model.ProblemFormat;

public record CreateProblemRequest(
        Long assignmentId,
        Long authorId,            // opcjonalnie
        String content,           // treść problemu
        ProblemFormat format      // ASCIIMATH lub MARKDOWN_TEX (opcjonalnie)
) {}
