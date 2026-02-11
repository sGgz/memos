package v1

import (
	"context"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

const (
	coverMebiByte             = 1024 * 1024
	defaultCoverListPageSize  = 50
	maxCoverListPageSize      = 1000
	coverImageFilenamePattern = "%d_%s%s"
)

func (s *APIV1Service) UploadCoverImage(ctx context.Context, request *v1pb.UploadCoverImageRequest) (*v1pb.UploadCoverImageResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Filename == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filename is required")
	}
	if len(request.Content) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "content is required")
	}

	coverStorageSetting, err := s.Store.GetInstanceCoverStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get cover storage setting: %v", err)
	}
	if coverStorageSetting.DirectoryPath == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "cover storage directory is not configured")
	}

	size := len(request.Content)
	uploadSizeLimit := int(coverStorageSetting.UploadSizeLimitMb) * coverMebiByte
	if uploadSizeLimit > 0 && size > uploadSizeLimit {
		return nil, status.Errorf(codes.InvalidArgument, "file size exceeds the limit")
	}

	contentType := http.DetectContentType(request.Content)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, status.Errorf(codes.InvalidArgument, "invalid image content type")
	}
	if !isAllowedCoverImageType(contentType) {
		return nil, status.Errorf(codes.InvalidArgument, "unsupported image content type")
	}

	ext := strings.ToLower(filepath.Ext(request.Filename))
	if ext == "" {
		if exts, _ := mime.ExtensionsByType(contentType); len(exts) > 0 {
			ext = exts[0]
		}
	}
	if ext == "" {
		switch contentType {
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		case "image/gif":
			ext = ".gif"
		}
	}

	filename := fmt.Sprintf(coverImageFilenamePattern, time.Now().UnixMilli(), shortuuid.New(), ext)
	if err := os.MkdirAll(coverStorageSetting.DirectoryPath, os.ModePerm); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to prepare cover storage directory: %v", err)
	}
	filePath := filepath.Join(coverStorageSetting.DirectoryPath, filename)
	if err := os.WriteFile(filePath, request.Content, 0644); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to write cover image: %v", err)
	}

	image := &v1pb.CoverImage{
		Filename:   filename,
		Url:        buildCoverImageURLFromRequest(ctx, coverStorageSetting.UrlPrefix, filename),
		CreateTime: time.Now().Unix(),
		Size:       int64(size),
	}
	return &v1pb.UploadCoverImageResponse{Image: image}, nil
}

func (s *APIV1Service) ListCoverImages(ctx context.Context, request *v1pb.ListCoverImagesRequest) (*v1pb.ListCoverImagesResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	coverStorageSetting, err := s.Store.GetInstanceCoverStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get cover storage setting: %v", err)
	}
	if coverStorageSetting.DirectoryPath == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "cover storage directory is not configured")
	}

	if err := os.MkdirAll(coverStorageSetting.DirectoryPath, os.ModePerm); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to prepare cover storage directory: %v", err)
	}

	entries, err := os.ReadDir(coverStorageSetting.DirectoryPath)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to read cover storage directory: %v", err)
	}

	type coverImageInfo struct {
		name    string
		modTime time.Time
		size    int64
	}
	images := []coverImageInfo{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		mimeType := mime.TypeByExtension(strings.ToLower(filepath.Ext(info.Name())))
		if !strings.HasPrefix(mimeType, "image/") {
			continue
		}
		if !isAllowedCoverImageType(mimeType) {
			continue
		}
		images = append(images, coverImageInfo{name: info.Name(), modTime: info.ModTime(), size: info.Size()})
	}

	sort.Slice(images, func(i, j int) bool {
		if images[i].modTime.Equal(images[j].modTime) {
			return images[i].name > images[j].name
		}
		return images[i].modTime.After(images[j].modTime)
	})

	pageSize := int(request.PageSize)
	if pageSize <= 0 {
		pageSize = defaultCoverListPageSize
	}
	if pageSize > maxCoverListPageSize {
		pageSize = maxCoverListPageSize
	}

	offset := 0
	if request.PageToken != "" {
		parsed, err := strconv.Atoi(request.PageToken)
		if err != nil || parsed < 0 {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token")
		}
		offset = parsed
	}

	response := &v1pb.ListCoverImagesResponse{
		TotalSize: int32(len(images)),
	}

	start := offset
	end := offset + pageSize
	if start > len(images) {
		start = len(images)
	}
	if end > len(images) {
		end = len(images)
	}

	for _, image := range images[start:end] {
		response.Images = append(response.Images, &v1pb.CoverImage{
			Filename:   image.name,
			Url:        buildCoverImageURLFromRequest(ctx, coverStorageSetting.UrlPrefix, image.name),
			CreateTime: image.modTime.Unix(),
			Size:       image.size,
		})
	}

	if end < len(images) {
		response.NextPageToken = strconv.Itoa(end)
	}

	return response, nil
}

func (s *APIV1Service) DeleteCoverImage(ctx context.Context, request *v1pb.DeleteCoverImageRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.GetFilename() == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filename is required")
	}

	coverStorageSetting, err := s.Store.GetInstanceCoverStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get cover storage setting: %v", err)
	}
	if coverStorageSetting.DirectoryPath == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "cover storage directory is not configured")
	}
	if err := os.MkdirAll(coverStorageSetting.DirectoryPath, os.ModePerm); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to prepare cover storage directory: %v", err)
	}

	filename := filepath.Base(request.GetFilename())
	if filename == "." || filename == string(filepath.Separator) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid filename")
	}
	filePath := filepath.Join(coverStorageSetting.DirectoryPath, filename)
	if err := os.Remove(filePath); err != nil {
		if os.IsNotExist(err) {
			return nil, status.Errorf(codes.NotFound, "cover image not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to delete cover image: %v", err)
	}
	return &emptypb.Empty{}, nil
}

func buildCoverImageURLFromRequest(ctx context.Context, urlPrefix string, filename string) string {
	trimmed := strings.TrimRight(urlPrefix, "/")
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed + "/" + filename
	}
	request := getRequestFromContext(ctx)
	if request == nil {
		return trimmed + "/" + filename
	}
	scheme := "http"
	if request.TLS != nil {
		scheme = "https"
	}
	forwardedProto := request.Header.Get("X-Forwarded-Proto")
	if forwardedProto != "" {
		scheme = forwardedProto
	}
	host := request.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = request.Host
	}
	if strings.HasPrefix(trimmed, "/") {
		return scheme + "://" + host + trimmed + "/" + filename
	}
	if trimmed == "" {
		return scheme + "://" + host + "/" + filename
	}
	return scheme + "://" + host + "/" + trimmed + "/" + filename
}

func getRequestFromContext(ctx context.Context) *http.Request {
	if ctx == nil {
		return nil
	}
	return nil
}

func isAllowedCoverImageType(contentType string) bool {
	allowed := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
	}
	return allowed[contentType]
}
