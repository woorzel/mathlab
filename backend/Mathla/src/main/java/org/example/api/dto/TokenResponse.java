package org.example.api.dto;

public record TokenResponse(
        String token,
        String role,
        Long userId,
        String email
) {}
