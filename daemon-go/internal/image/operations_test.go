package image

import (
	"fmt"
	"testing"
)

func BenchmarkLinearSearch(b *testing.B) {
	// Create a map with 1M existing files
	existingFiles := make(map[string]bool)
	for i := 1; i <= 1000000; i++ {
		existingFiles[fmt.Sprintf("image(%d).jpg", i)] = true
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Simulate the old linear search approach
		originalFileName := "image.jpg"
		ext := ".jpg"
		fileNameWithoutExt := "image"

		uniqueFileName := originalFileName
		count := 1

		for existingFiles[uniqueFileName] {
			uniqueFileName = fmt.Sprintf("%s(%d)%s", fileNameWithoutExt, count, ext)
			count++
		}
	}
}

func BenchmarkBinarySearch(b *testing.B) {
	// Create a map with 1M existing files
	existingFiles := make(map[string]bool)
	for i := 1; i <= 1000000; i++ {
		existingFiles[fmt.Sprintf("image(%d).jpg", i)] = true
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Use the new binary search approach
		originalFileName := "image.jpg"
		ext := ".jpg"
		fileNameWithoutExt := "image"

		if !existingFiles[originalFileName] {
			continue
		}

		// Binary search for the highest existing number
		left, right := 1, 1048576
		for left <= right {
			mid := (left + right) / 2
			testName := fmt.Sprintf("%s(%d)%s", fileNameWithoutExt, mid, ext)

			if existingFiles[testName] {
				left = mid + 1
			} else {
				right = mid - 1
			}
		}

		// The next available number
		_ = fmt.Sprintf("%s(%d)%s", fileNameWithoutExt, right+1, ext)
	}
}

func TestCorrectness(t *testing.T) {
	// Create a map with some existing files
	existingFiles := make(map[string]bool)
	existingFiles["image.jpg"] = true
	existingFiles["image(1).jpg"] = true
	existingFiles["image(2).jpg"] = true
	existingFiles["image(5).jpg"] = true
	existingFiles["image(10).jpg"] = true

	// Test our new function
	result := GetUniqueFileName(existingFiles, "image.jpg")
	expected := "image(3).jpg" // Should find the first gap

	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}

	// Test with a file that doesn't exist
	result = GetUniqueFileName(existingFiles, "newimage.jpg")
	expected = "newimage.jpg"

	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}
}
