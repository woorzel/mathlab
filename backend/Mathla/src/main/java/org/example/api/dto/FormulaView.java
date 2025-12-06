package org.example.api.dto;

public record FormulaView(
        Long id,
        String rawInput,
        String inputType,   // "ASCIIMATH" | "TEX"
        String mathml,
        String speechText,
        Long submissionId,
        Long problemId,
        String createdAt
) {}
