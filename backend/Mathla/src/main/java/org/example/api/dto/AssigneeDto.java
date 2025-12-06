// src/main/java/org/example/api/dto/AssigneeDto.java
package org.example.api.dto;

import org.example.model.User;
import java.time.OffsetDateTime;

public record AssigneeDto(Long id, String name, String email, String dueAt) {
    public static AssigneeDto from(User u, OffsetDateTime due) {
        return new AssigneeDto(u.getId(), u.getName(), u.getEmail(),
                due == null ? null : due.toString());
    }
}