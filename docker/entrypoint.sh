name: Build & Push Docker (GHCR)

on:
  push:
    branches: [ "main" ]

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }} # owner/repo
  # Si querés otra ruta, poné algo como: IMAGE_NAME: owner/restaurant-ai

jobs:
  build-and-push:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up QEMU (multi-arch opcional)
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # (Opcional) build de la app fuera del contenedor para validar que compila
      # - name: Node install & build
      #   uses: actions/setup-node@v4
      #   with:
      #     node-version: 20
      #     cache: npm
      #   env:
      #     GOOGLE_API_KEY: "dummy"   # evita fallar en build si tu code la pide en build
      #   run: |
      #     npm ci
      #     npx prisma generate
      #     npm run build

      - name: Extract Git metadata
        id: meta
        run: |
          echo "sha_short=${GITHUB_SHA::7}" >> $GITHUB_OUTPUT
          echo "ref_name=${GITHUB_REF_NAME}" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/amd64 # ,linux/arm64 si querés multi-arch
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.sha_short }}
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
