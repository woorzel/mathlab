package org.example.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GradeSubmissionRequest(
        String score,
        String status,
        String reviewNote,
        Boolean teacherOverride,
        Long teacherId
) {}
