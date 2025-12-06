// org/example/api/dto/UpdateSubmissionRequest.java
package org.example.api.dto;

public record UpdateSubmissionRequest(
        String textAnswer,  // opcjonalnie
        String status       // opcjonalnie: "DRAFT" | "SUBMITTED" | "GRADED"
) {}
