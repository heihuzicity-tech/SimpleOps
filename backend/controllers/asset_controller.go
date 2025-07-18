package controllers

import (
	"bastion/models"
	"bastion/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AssetController 资产控制器
type AssetController struct {
	assetService *services.AssetService
}

// NewAssetController 创建资产控制器实例
func NewAssetController(assetService *services.AssetService) *AssetController {
	return &AssetController{assetService: assetService}
}

// CreateAsset 创建资产
// @Summary      创建资产
// @Description  创建新的服务器或数据库资产
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body models.AssetCreateRequest true "资产创建请求"
// @Success      201  {object}  map[string]interface{}  "创建成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      409  {object}  map[string]interface{}  "资产名称已存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /assets [post]
func (ac *AssetController) CreateAsset(c *gin.Context) {
	var request models.AssetCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用资产服务
	asset, err := ac.assetService.CreateAsset(&request)
	if err != nil {
		if err.Error() == "asset name already exists" {
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create asset",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    asset,
	})
}

// GetAssets 获取资产列表
// @Summary      获取资产列表
// @Description  获取资产列表，支持分页和过滤
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page      query     int     false  "页码"
// @Param        page_size query     int     false  "每页大小"
// @Param        keyword   query     string  false  "关键字搜索"
// @Param        type      query     string  false  "资产类型"
// @Param        status    query     int     false  "状态"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /assets [get]
func (ac *AssetController) GetAssets(c *gin.Context) {
	var request models.AssetListRequest
	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request parameters",
			"details": err.Error(),
		})
		return
	}

	// 设置默认值
	if request.Page <= 0 {
		request.Page = 1
	}
	if request.PageSize <= 0 {
		request.PageSize = 10
	}

	// 调用资产服务
	assets, total, err := ac.assetService.GetAssets(&request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get assets",
			"details": err.Error(),
		})
		return
	}

	// 计算分页信息
	totalPages := (total + int64(request.PageSize) - 1) / int64(request.PageSize)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"assets": assets,
			"pagination": gin.H{
				"page":       request.Page,
				"page_size":  request.PageSize,
				"total":      total,
				"total_page": totalPages,
			},
		},
	})
}

// GetAsset 获取单个资产
// @Summary      获取资产详情
// @Description  根据ID获取单个资产的详细信息
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      int  true  "资产ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /assets/{id} [get]
func (ac *AssetController) GetAsset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid asset ID",
		})
		return
	}

	// 调用资产服务
	asset, err := ac.assetService.GetAsset(uint(id))
	if err != nil {
		if err.Error() == "asset not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get asset",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    asset,
	})
}

// UpdateAsset 更新资产
// @Summary      更新资产
// @Description  更新指定ID的资产信息
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path      int  true  "资产ID"
// @Param        request body models.AssetUpdateRequest true "资产更新请求"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产不存在"
// @Failure      409  {object}  map[string]interface{}  "资产名称已存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /assets/{id} [put]
func (ac *AssetController) UpdateAsset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid asset ID",
		})
		return
	}

	var request models.AssetUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用资产服务
	asset, err := ac.assetService.UpdateAsset(uint(id), &request)
	if err != nil {
		switch err.Error() {
		case "asset not found":
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		case "asset name already exists":
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to update asset",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    asset,
	})
}

// DeleteAsset 删除资产
// @Summary      删除资产
// @Description  删除指定ID的资产
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      int  true  "资产ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /assets/{id} [delete]
func (ac *AssetController) DeleteAsset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid asset ID",
		})
		return
	}

	// 调用资产服务
	err = ac.assetService.DeleteAsset(uint(id))
	if err != nil {
		if err.Error() == "asset not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete asset",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Asset deleted successfully",
	})
}

// CreateCredential 创建凭证
// @Summary      创建凭证
// @Description  为指定资产创建新的凭证
// @Tags         凭证管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body models.CredentialCreateRequest true "凭证创建请求"
// @Success      201  {object}  map[string]interface{}  "创建成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /credentials [post]
func (ac *AssetController) CreateCredential(c *gin.Context) {
	var request models.CredentialCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用资产服务
	credential, err := ac.assetService.CreateCredential(&request)
	if err != nil {
		if err.Error() == "asset not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create credential",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    credential,
	})
}

// GetCredentials 获取凭证列表
// @Summary      获取凭证列表
// @Description  获取凭证列表，支持分页和过滤
// @Tags         凭证管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        page      query     int     false  "页码"
// @Param        page_size query     int     false  "每页大小"
// @Param        keyword   query     string  false  "关键字搜索"
// @Param        type      query     string  false  "凭证类型"
// @Param        asset_id  query     int     false  "资产ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /credentials [get]
func (ac *AssetController) GetCredentials(c *gin.Context) {
	var request models.CredentialListRequest
	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request parameters",
		})
		return
	}

	// 设置默认值
	if request.Page <= 0 {
		request.Page = 1
	}
	if request.PageSize <= 0 {
		request.PageSize = 10
	}

	// 调用资产服务
	credentials, total, err := ac.assetService.GetCredentials(&request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get credentials",
		})
		return
	}

	// 计算分页信息
	totalPages := (total + int64(request.PageSize) - 1) / int64(request.PageSize)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"credentials": credentials,
			"pagination": gin.H{
				"page":       request.Page,
				"page_size":  request.PageSize,
				"total":      total,
				"total_page": totalPages,
			},
		},
	})
}

// GetCredential 获取单个凭证
// @Summary      获取凭证详情
// @Description  根据ID获取单个凭证的详细信息
// @Tags         凭证管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      int  true  "凭证ID"
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "凭证不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /credentials/{id} [get]
func (ac *AssetController) GetCredential(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid credential ID",
		})
		return
	}

	// 调用资产服务
	credential, err := ac.assetService.GetCredential(uint(id))
	if err != nil {
		if err.Error() == "credential not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get credential",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    credential,
	})
}

// UpdateCredential 更新凭证
// @Summary      更新凭证
// @Description  更新指定ID的凭证信息
// @Tags         凭证管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path      int  true  "凭证ID"
// @Param        request body models.CredentialUpdateRequest true "凭证更新请求"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "凭证不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /credentials/{id} [put]
func (ac *AssetController) UpdateCredential(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid credential ID",
		})
		return
	}

	var request models.CredentialUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用资产服务
	credential, err := ac.assetService.UpdateCredential(uint(id), &request)
	if err != nil {
		if err.Error() == "credential not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update credential",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    credential,
	})
}

// DeleteCredential 删除凭证
// @Summary      删除凭证
// @Description  删除指定ID的凭证
// @Tags         凭证管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      int  true  "凭证ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "凭证不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /credentials/{id} [delete]
func (ac *AssetController) DeleteCredential(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid credential ID",
		})
		return
	}

	// 调用资产服务
	err = ac.assetService.DeleteCredential(uint(id))
	if err != nil {
		if err.Error() == "credential not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete credential",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Credential deleted successfully",
	})
}

// TestConnection 测试连接
// @Summary      测试连接
// @Description  测试资产连接是否正常
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body models.ConnectionTestRequest true "连接测试请求"
// @Success      200  {object}  map[string]interface{}  "测试完成"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产或凭证不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /assets/test-connection [post]
func (ac *AssetController) TestConnection(c *gin.Context) {
	var request models.ConnectionTestRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	// 调用资产服务
	result, err := ac.assetService.TestConnection(&request)
	if err != nil {
		switch err.Error() {
		case "asset not found", "credential not found":
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
		case "credential does not belong to the asset":
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to test connection",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// ======================== 资产分组管理 ========================

// CreateAssetGroup 创建资产分组
func (ac *AssetController) CreateAssetGroup(c *gin.Context) {
	var request models.AssetGroupCreateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	group, err := ac.assetService.CreateAssetGroup(&request)
	if err != nil {
		if err.Error() == "asset group name already exists" {
			c.JSON(http.StatusConflict, gin.H{
				"error": "资产分组名称已存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "创建资产分组失败",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    group,
	})
}

// GetAssetGroups 获取资产分组列表
func (ac *AssetController) GetAssetGroups(c *gin.Context) {
	var request models.AssetGroupListRequest
	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 设置默认分页参数
	if request.Page == 0 {
		request.Page = 1
	}
	if request.PageSize == 0 {
		request.PageSize = 10
	}

	groups, total, err := ac.assetService.GetAssetGroups(&request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取资产分组列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    groups,
		"total":   total,
	})
}

// GetAssetGroup 获取单个资产分组
func (ac *AssetController) GetAssetGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid group ID",
		})
		return
	}

	group, err := ac.assetService.GetAssetGroup(uint(id))
	if err != nil {
		if err.Error() == "asset group not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "资产分组不存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "获取资产分组失败",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    group,
	})
}

// UpdateAssetGroup 更新资产分组
func (ac *AssetController) UpdateAssetGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid group ID",
		})
		return
	}

	var request models.AssetGroupUpdateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	group, err := ac.assetService.UpdateAssetGroup(uint(id), &request)
	if err != nil {
		if err.Error() == "asset group not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "资产分组不存在",
			})
		} else if err.Error() == "asset group name already exists" {
			c.JSON(http.StatusConflict, gin.H{
				"error": "资产分组名称已存在",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "更新资产分组失败",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    group,
	})
}

// DeleteAssetGroup 删除资产分组
func (ac *AssetController) DeleteAssetGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid group ID",
		})
		return
	}

	err = ac.assetService.DeleteAssetGroup(uint(id))
	if err != nil {
		if err.Error() == "asset group not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "资产分组不存在",
			})
		} else if err.Error() == "cannot delete asset group with associated assets" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "无法删除有关联资产的分组",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "删除资产分组失败",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "资产分组删除成功",
	})
}

// BatchMoveAssets 批量移动资产到分组（管理员专用）
// @Summary      批量移动资产到分组
// @Description  批量移动指定资产到目标分组，只有管理员可以操作
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body models.AssetBatchMoveRequest true "批量移动请求"
// @Success      200  {object}  map[string]interface{}  "移动成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      404  {object}  map[string]interface{}  "资产或分组不存在"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /admin/assets/batch-move [post]
func (ac *AssetController) BatchMoveAssets(c *gin.Context) {
	var request models.AssetBatchMoveRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数格式错误",
			"details": err.Error(),
		})
		return
	}

	// 调用资产服务
	err := ac.assetService.BatchMoveAssetsToGroup(&request)
	if err != nil {
		switch err.Error() {
		case "some assets not found or deleted":
			c.JSON(http.StatusNotFound, gin.H{
				"error": "部分资产不存在或已删除",
			})
		case "target group not found":
			c.JSON(http.StatusNotFound, gin.H{
				"error": "目标分组不存在",
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "批量移动资产失败",
				"details": err.Error(),
			})
		}
		return
	}

	// 构建成功响应消息
	var message string
	if request.TargetGroupID != nil {
		message = "成功移动资产到指定分组"
	} else {
		message = "成功将资产移出所有分组"
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": message,
		"data": gin.H{
			"moved_count": len(request.AssetIDs),
			"target_group_id": request.TargetGroupID,
		},
	})
}

// GetAssetGroupsWithHosts 获取包含主机详情的资产分组列表（用于控制台树形菜单）
// @Summary      获取包含主机详情的资产分组列表
// @Description  获取资产分组列表，包含每个分组下的主机详细信息，用于控制台树形菜单显示
// @Tags         资产管理
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        type    query     string  false  "资产类型过滤" Enums(server, database)
// @Success      200  {object}  map[string]interface{}  "获取成功"
// @Failure      400  {object}  map[string]interface{}  "请求参数错误"
// @Failure      401  {object}  map[string]interface{}  "未授权"
// @Failure      403  {object}  map[string]interface{}  "权限不足"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /asset-groups/with-hosts [get]
func (ac *AssetController) GetAssetGroupsWithHosts(c *gin.Context) {
	// 获取资产类型过滤参数
	assetType := c.Query("type")
	
	// 验证资产类型
	if assetType != "" && assetType != "server" && assetType != "database" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid asset type. Must be 'server' or 'database'",
		})
		return
	}

	// 调用资产服务
	groups, err := ac.assetService.GetAssetGroupsWithHosts(assetType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取资产分组列表失败",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    groups,
	})
}
