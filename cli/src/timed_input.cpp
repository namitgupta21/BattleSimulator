#include "cli/timed_input.hpp"
#include <iostream>
#include <string>
#include <limits>
#include <chrono>
#include <thread>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <set>

#ifdef _WIN32
#include <io.h>
#define ISATTY _isatty
#define FILENO _fileno
#else
#include <unistd.h>
#define ISATTY isatty
#define FILENO fileno
#endif

namespace cli {

bool TimedInput::isInteractiveConsole() {
    return ISATTY(FILENO(stdin)) != 0;
}

std::optional<int> TimedInput::getTimedChoice(
    int minChoice,
    int maxChoice,
    bool enableTimer,
    int timeoutSeconds,
    const std::vector<int>& warningMarks
) {
    if (!enableTimer || timeoutSeconds <= 0) {
        // Standard blocking input without timer
        while (true) {
            std::cout << "Enter selection (" << minChoice << "-" << maxChoice << "): ";
            int choice = 0;
            if (std::cin >> choice) {
                if (choice >= minChoice && choice <= maxChoice) {
                    return choice;
                }
            } else {
                if (std::cin.eof()) {
                    std::cout << "\n[EOF detected, selecting default action " << minChoice << "]\n";
                    return minChoice;
                }
                std::cin.clear();
                std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            }
            std::cout << "Invalid choice. Please try again.\n";
        }
    }

    // Timed input with countdown warnings
    std::cout << "Enter selection (" << minChoice << "-" << maxChoice 
              << ") [Timer: " << timeoutSeconds << "s max]: " << std::flush;

    std::mutex mtx;
    std::condition_variable cv;
    std::optional<int> userChoice;
    std::atomic<bool> inputReady{false};
    std::atomic<bool> timedOut{false};

    std::thread inputThread([&]() {
        while (!timedOut.load()) {
            std::string line;
            if (!std::getline(std::cin, line)) {
                if (std::cin.eof()) {
                    // Stdin closed or at EOF: sleep briefly to avoid spin and let countdown timer expire
                    std::this_thread::sleep_for(std::chrono::milliseconds(100));
                    continue;
                }
                std::cin.clear();
                continue;
            }
            if (timedOut.load()) {
                return;
            }

            // Trim leading/trailing whitespace
            size_t first = line.find_first_not_of(" \t\r\n");
            if (first == std::string::npos) continue;
            size_t last = line.find_last_not_of(" \t\r\n");
            line = line.substr(first, last - first + 1);

            try {
                int val = std::stoi(line);
                if (val >= minChoice && val <= maxChoice) {
                    std::lock_guard<std::mutex> lock(mtx);
                    userChoice = val;
                    inputReady.store(true);
                    cv.notify_one();
                    return;
                } else {
                    std::cout << "Invalid choice (" << minChoice << "-" << maxChoice << "). Try again: " << std::flush;
                }
            } catch (...) {
                std::cout << "Invalid number. Try again (" << minChoice << "-" << maxChoice << "): " << std::flush;
            }
        }
    });

    auto startTime = std::chrono::steady_clock::now();
    std::set<int> announcedMarks;

    while (true) {
        std::unique_lock<std::mutex> lock(mtx);
        if (cv.wait_for(lock, std::chrono::milliseconds(250), [&]() { return inputReady.load(); })) {
            // Valid input received before timeout
            break;
        }

        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::steady_clock::now() - startTime
        ).count();
        int remaining = timeoutSeconds - static_cast<int>(elapsed);

        if (remaining <= 0) {
            timedOut.store(true);
            std::cout << "\n\n============================================================\n";
            std::cout << " [TIME EXPIRED] Maximum turn time of " << timeoutSeconds << " seconds exceeded!\n";
            std::cout << "============================================================\n";
            break;
        }

        for (int mark : warningMarks) {
            if (mark < timeoutSeconds && remaining <= mark && announcedMarks.find(mark) == announcedMarks.end()) {
                announcedMarks.insert(mark);
                if (mark == 60) {
                    std::cout << "\n[TIMER WARNING] 1 minute remaining!\n";
                } else if (mark == 1) {
                    std::cout << "\n[TIMER WARNING] 1 second remaining!\n";
                } else {
                    std::cout << "\n[TIMER WARNING] " << mark << " seconds remaining!\n";
                }
                std::cout << "Enter selection (" << minChoice << "-" << maxChoice << "): " << std::flush;
            }
        }
    }

    if (inputReady.load()) {
        if (inputThread.joinable()) {
            inputThread.join();
        }
        return userChoice;
    } else {
        // Timed out: detach input thread as the match terminates immediately
        timedOut.store(true);
        if (inputThread.joinable()) {
            inputThread.detach();
        }
        return std::nullopt;
    }
}

} // namespace cli
