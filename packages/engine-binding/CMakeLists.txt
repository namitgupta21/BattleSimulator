cmake_minimum_required(VERSION 3.16)
project(pokemon_engine_binding LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(DEFINED CMAKE_JS_INC)
    set(NODE_INC ${CMAKE_JS_INC})
    set(NODE_LIB ${CMAKE_JS_LIB})
else()
    # Try finding node headers dynamically from current node binary (Linux, Docker, CI)
    execute_process(
        COMMAND node -e "console.log(require('path').resolve(process.execPath, '..', '..', 'include', 'node'))"
        OUTPUT_VARIABLE SYSTEM_NODE_INC
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
    )
    if(EXISTS "${SYSTEM_NODE_INC}/node_api.h")
        set(NODE_INC "${SYSTEM_NODE_INC}")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/.cmake-dist/include/node/node_api.h")
        set(NODE_INC "${CMAKE_CURRENT_SOURCE_DIR}/.cmake-dist/include/node")
    endif()

    if(WIN32)
        if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/.cmake-dist/win-x64/node.lib")
            set(NODE_LIB "${CMAKE_CURRENT_SOURCE_DIR}/.cmake-dist/win-x64/node.lib")
        endif()
    endif()
endif()

# Locate node-addon-api headers
find_path(NODE_ADDON_API_DIR "napi.h"
    PATHS
    "${CMAKE_CURRENT_SOURCE_DIR}/node_modules/node-addon-api"
    "${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/node-addon-api"
)

add_library(pokemon_engine_binding MODULE
    src/binding.cpp
)

set_target_properties(pokemon_engine_binding PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    OUTPUT_NAME "pokemon_engine_binding"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/build"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/build"
)

target_include_directories(pokemon_engine_binding PRIVATE
    ${NODE_INC}
    ${NODE_ADDON_API_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../../engine/include
)

target_link_libraries(pokemon_engine_binding PRIVATE
    pokemon_engine
    ${NODE_LIB}
)

target_compile_definitions(pokemon_engine_binding PRIVATE
    NAPI_DISABLE_CPP_EXCEPTIONS
    NAPI_VERSION=8
)
