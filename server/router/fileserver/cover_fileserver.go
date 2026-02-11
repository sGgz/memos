package fileserver

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

const coverStaticPrefix = "/cover/"

func (s *FileServerService) RegisterCoverRoutes(echoServer *echo.Echo) error {
	echoServer.GET(coverStaticPrefix+"*", func(c echo.Context) error {
		coverStorageSetting, err := s.Store.GetInstanceCoverStorageSetting(c.Request().Context())
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to get cover storage setting").SetInternal(err)
		}
		if !coverStorageSetting.EnableLocalServer || coverStorageSetting.DirectoryPath == "" {
			return echo.NewHTTPError(http.StatusNotFound, "cover server disabled")
		}
		if err := os.MkdirAll(coverStorageSetting.DirectoryPath, os.ModePerm); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to prepare cover storage directory").SetInternal(err)
		}

		reqPath := strings.TrimPrefix(c.Request().URL.Path, coverStaticPrefix)
		reqPath = filepath.ToSlash(filepath.Clean("/" + reqPath))
		if strings.Contains(reqPath, "..") {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid path")
		}
		reqPath = strings.TrimPrefix(reqPath, "/")
		return c.File(filepath.Join(coverStorageSetting.DirectoryPath, reqPath))
	})
	return nil
}
