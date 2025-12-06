// src/main/java/org/example/api/GlobalExceptionHandler.java
package org.example.api;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleRSE(ResponseStatusException ex) {
    String reason = ex.getReason() != null ? ex.getReason() : "ERROR";
    return ResponseEntity.status(ex.getStatusCode())
        .body(Map.of(
                        "code", (reason != null ? reason : "ERROR").toUpperCase().replace(' ', '_'),
            "message", reason
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
    List<Map<String, String>> details = ex.getBindingResult().getFieldErrors().stream()
        .map(this::toDetail)
        .collect(Collectors.toList());
    return ResponseEntity.status(HttpStatus.BAD_REQUEST.value())
        .body(Map.of(
            "code", "VALIDATION_ERROR",
            "message", "Validation failed",
            "details", details
        ));
    }

    private Map<String, String> toDetail(FieldError fe) {
    return Map.of(
        "field", fe.getField(),
        "message", fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value"
    );
    }

    // np. unikalny e-mail „poza kontrolerem” → 409
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDiV(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT.value())
                .body(Map.of(
                        "code", "EMAIL_ALREADY_USED",
                        "message", "Email already used"
                ));
    }
}
