find_package(Threads REQUIRED)

add_executable(pokemon_cli
    src/main.cpp
    src/human_player.cpp
    src/random_player.cpp
    src/renderer.cpp
    src/timed_input.cpp
)

target_include_directories(pokemon_cli PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(pokemon_cli PRIVATE
    pokemon_engine
    Threads::Threads
)
