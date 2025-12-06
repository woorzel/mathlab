package org.example.api.dto;

import org.example.model.User;
import org.example.model.UserRole;

public record UserDto(Long id, String email, String name, UserRole role) {
    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getName(), u.getRole());
    }
}
