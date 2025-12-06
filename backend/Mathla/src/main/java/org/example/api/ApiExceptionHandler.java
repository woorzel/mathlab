package org.example.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArg(IllegalArgumentException ex) {
        // Domyślnie 400 Bad Request, spójny schemat błędów
        return ResponseEntity.status(HttpStatus.BAD_REQUEST.value())
                .body(Map.of(
                        "code", "BAD_REQUEST",
                        "message", ex.getMessage() != null ? ex.getMessage() : "Bad request"
                ));
    }
}
