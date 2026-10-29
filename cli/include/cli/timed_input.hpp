#pragma once

#include <optional>
#include <vector>

namespace cli {

/**
 * @brief Handles user input with optional turn countdown timer and warning thresholds.
 */
class TimedInput {
public:
    /**
     * @brief Prompts for an integer choice in [minChoice, maxChoice].
     * If enableTimer is true, counts down from timeoutSeconds (default 90s / 1.5m).
     * Emits warning messages at 60s, 30s, 15s, 10s, 5s, 4s, 3s, 2s, 1s marks.
     * Returns std::nullopt if the timer expires before a valid choice is entered.
     */
    static std::optional<int> getTimedChoice(
        int minChoice,
        int maxChoice,
        bool enableTimer,
        int timeoutSeconds = 90,
        const std::vector<int>& warningMarks = {60, 30, 15, 10, 5, 4, 3, 2, 1}
    );

    /**
     * @brief Checks whether standard input is attached to an interactive terminal console.
     */
    static bool isInteractiveConsole();
};

} // namespace cli

