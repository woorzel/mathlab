package org.example.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GradeMissingRequest(
        Long assignmentId,
        Long studentId,
        String score,
        String reviewNote,
        Boolean teacherOverride,
        Long teacherId
) {}
