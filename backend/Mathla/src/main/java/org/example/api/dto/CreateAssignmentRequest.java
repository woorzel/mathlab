package org.example.api.dto;

public record CreateAssignmentRequest(
        Long teacherId,
        String title,
        String description,
        String dueAt,
        // JEDYNY problem do zadania:
        String problemContent,      // treść (Markdown/tekst + TeX) lub surowy AsciiMath
        String problemFormat        // "TEX" lub "ASCIIMATH" (domyślnie TEX)
) {}
