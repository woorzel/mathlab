// src/main/java/org/example/repo/UserPrefsRepository.java
package org.example.repo;

import org.example.model.UserPrefs;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPrefsRepository extends JpaRepository<UserPrefs, Long> {
}
