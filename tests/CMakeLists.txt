include(FetchContent)

FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
)

# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

add_executable(pokemon_tests
    test_damage_calc.cpp
    test_type_chart.cpp
    test_turn_order.cpp
    test_status.cpp
    test_determinism.cpp
    test_serialization.cpp
    test_data_provider.cpp
    test_team_generator.cpp
    test_simulation_stress.cpp
)

target_link_libraries(pokemon_tests PRIVATE
    pokemon_engine
    GTest::gtest_main
)

include(GoogleTest)
gtest_discover_tests(pokemon_tests)
