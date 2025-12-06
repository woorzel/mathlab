package org.example.model;

public enum SubmissionStatus {
    DRAFT,      // uczeń tworzy/edytuje
    SUBMITTED,
    REVIEWED,
    GRADED,     // ocenione
    REJECTED    // odrzucone (np. błędne / do poprawy)
}
