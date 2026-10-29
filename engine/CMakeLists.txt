add_library(pokemon_engine STATIC
    src/type_chart.cpp
    src/damage_calc.cpp
    src/effects.cpp
    src/engine.cpp
    src/data_loader.cpp
    src/local_json_provider.cpp
    src/team_generator.cpp
    src/serializer.cpp
)

target_include_directories(pokemon_engine PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# On Windows/MinGW, link filesystem library if needed
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU" AND CMAKE_CXX_COMPILER_VERSION VERSION_LESS 9.0)
    target_link_libraries(pokemon_engine PUBLIC stdc++fs)
endif()
