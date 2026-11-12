cmake_minimum_required(VERSION 3.16)
project(PokemonProjectGame VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Subdirectories
add_subdirectory(engine)
add_subdirectory(apps/cli)

# Unit Testing
enable_testing()
add_subdirectory(tests)

# Node N-API Engine Binding
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/packages/engine-binding/CMakeLists.txt")
    add_subdirectory(packages/engine-binding)
endif()
