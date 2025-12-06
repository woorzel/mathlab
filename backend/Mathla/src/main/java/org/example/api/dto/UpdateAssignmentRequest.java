package org.example.api.dto;

public record UpdateAssignmentRequest(
        String title,
        String description,
        String dueAt,
        String problemContent,  // opcjonalnie: nowa treść problemu
        String problemFormat    // opcjonalnie: MARKDOWN_TEX | ASCIIMATH
) {}
