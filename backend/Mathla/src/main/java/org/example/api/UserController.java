package org.example.api;

import org.example.api.dto.UserDto;
import org.example.model.UserRole;
import org.example.repo.UserRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository repo;

    public UserController(UserRepository repo) {
        this.repo = repo;
    }

    // GET /api/users?role=STUDENT&q=jan
    @GetMapping
    public List<UserDto> list(
            @RequestParam(required = false) String role,
            @RequestParam(required = false, name = "q") String query
    ) {
        var all = (role != null && role.equalsIgnoreCase("STUDENT"))
                ? repo.findAll().stream().filter(u -> u.getRole() == UserRole.STUDENT).toList()
                : repo.findAll();

        if (query == null || query.isBlank()) {
            return all.stream().map(UserDto::from).toList();
        }
        String q = query.toLowerCase();
        return all.stream()
                .filter(u ->
                        (u.getEmail() != null && u.getEmail().toLowerCase().contains(q)) ||
                                (u.getName()  != null && u.getName().toLowerCase().contains(q))
                )
                .map(UserDto::from)
                .toList();
    }
    @GetMapping("/{id}")
    public UserDto one(@PathVariable Long id) {
        var u = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserDto.from(u);
    }
}
