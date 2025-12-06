package org.example.api.dto;

public record ChangePasswordRequest(String oldPassword, String newPassword) {}