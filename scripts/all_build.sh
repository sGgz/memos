#!/bin/sh

set -e

show_usage() {
  cat <<'USAGE'
用法: ./scripts/all_build.sh [选项]

选项:
  -f, --frontend   编译前端（pnpm build && pnpm release）
  -b, --backend    编译后端（./scripts/build.sh）
  -s, --start      仅启动服务（跳过编译）
  -h, --help       显示帮助

说明:
  - 选项支持多选，例如: ./scripts/all_build.sh -f -b
  - 不传任何选项时，默认执行全部步骤（前端 + 后端 + 启动服务）
  - 选择任意编译选项（-f 或 -b）时，编译成功后会自动启动服务
  - 仅传 -s 时只启动服务，不会执行编译
USAGE
}

run_frontend=false
run_backend=false
run_start=false
explicit_start=false
has_selection=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    -f|--frontend)
      run_frontend=true
      has_selection=true
      ;;
    -b|--backend)
      run_backend=true
      has_selection=true
      ;;
    -s|--start)
      explicit_start=true
      has_selection=true
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      show_usage >&2
      exit 1
      ;;
  esac
  shift
done

if [ "$has_selection" = false ]; then
  run_frontend=true
  run_backend=true
  run_start=true
else
  if [ "$explicit_start" = true ]; then
    run_start=true
  elif [ "$run_frontend" = true ] || [ "$run_backend" = true ]; then
    run_start=true
  fi
fi

# Change to repo root
cd "$(dirname "$0")/../"

if [ "$run_frontend" = true ]; then
  echo "[all_build] 开始编译前端..."
  (
    cd web
    pnpm build && pnpm release
  )
fi

if [ "$run_backend" = true ]; then
  echo "[all_build] 开始编译后端..."
  ./scripts/build.sh
fi

if [ "$run_start" = true ]; then
  echo "[all_build] 启动服务..."
  if [ ! -x "./build/memos" ]; then
    echo "错误: 未找到可执行文件 ./build/memos，请先执行后端编译。" >&2
    exit 1
  fi
  cd ./build
  ./memos --addr "${MEMOS_ADDR:-192.168.1.38}" --port "${MEMOS_PORT:-12345}" --data "${MEMOS_DATA:-..\\run}"
fi
