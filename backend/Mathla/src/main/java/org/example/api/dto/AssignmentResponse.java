package org.example.api.dto;

public record AssignmentResponse(
        Long id,
        Long teacherId,
        String teacherName,
        String title,
        String description,
        String dueAt,         // globalny (może być null – i tak go pomijamy na froncie)
        String createdAt,
        String problemFormat,
        String problemContent,
        String studentDueAt   // ⬅️ TERMIN Z PRZYDZIAŁU
) {}