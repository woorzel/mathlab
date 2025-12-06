// src/main/java/org/example/model/UserPrefs.java
package org.example.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "user_prefs")
public class UserPrefs {

    @Id
    @Column(name = "user_id")
    private Long userId; // 1-1 z użytkownikiem

    @Column(name = "email_on_submit", nullable = false)
    private boolean emailOnSubmit = false;

    @Column(name = "daily_digest", nullable = false)
    private boolean dailyDigest = false;

    @Column(name = "default_format", nullable = false, length = 16)
    private String defaultFormat = "ASCIIMATH"; // ASCIIMATH | TEX

    @Column(name = "theme", nullable = false, length = 16)
    private String theme = "auto"; // auto | light | dark

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    // gettery/settery
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public boolean isEmailOnSubmit() { return emailOnSubmit; }
    public void setEmailOnSubmit(boolean emailOnSubmit) { this.emailOnSubmit = emailOnSubmit; }

    public boolean isDailyDigest() { return dailyDigest; }
    public void setDailyDigest(boolean dailyDigest) { this.dailyDigest = dailyDigest; }

    public String getDefaultFormat() { return defaultFormat; }
    public void setDefaultFormat(String defaultFormat) { this.defaultFormat = defaultFormat; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
