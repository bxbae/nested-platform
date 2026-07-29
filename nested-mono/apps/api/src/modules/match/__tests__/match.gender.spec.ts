import {
  acceptsGender,
  isMutuallyGenderCompatible,
  resolveVisibleGender,
} from "../match.module";

describe("roommate gender matching", () => {
  describe("acceptsGender", () => {
    it("ANY는 모든 성별을 허용한다", () => {
      expect(acceptsGender("ANY", "MALE")).toBe(true);
      expect(acceptsGender("ANY", "FEMALE")).toBe(true);
      expect(acceptsGender("ANY", "OTHER")).toBe(true);
    });

    it("남성 선호는 남성만 허용한다", () => {
      expect(acceptsGender("MALE", "MALE")).toBe(true);
      expect(acceptsGender("MALE", "FEMALE")).toBe(false);
      expect(acceptsGender("MALE", "OTHER")).toBe(false);
    });

    it("여성 선호는 여성만 허용한다", () => {
      expect(acceptsGender("FEMALE", "FEMALE")).toBe(true);
      expect(acceptsGender("FEMALE", "MALE")).toBe(false);
      expect(acceptsGender("FEMALE", "OTHER")).toBe(false);
    });
  });

  describe("isMutuallyGenderCompatible", () => {
    it("서로의 성별 선호를 모두 만족하면 매칭된다", () => {
      const result = isMutuallyGenderCompatible(
        {
          gender: "MALE",
          roommateGenderPreference: "FEMALE",
        },
        {
          gender: "FEMALE",
          roommateGenderPreference: "ANY",
        },
      );

      expect(result).toBe(true);
    });

    it("한쪽의 성별 선호라도 만족하지 않으면 제외된다", () => {
      const result = isMutuallyGenderCompatible(
        {
          gender: "MALE",
          roommateGenderPreference: "FEMALE",
        },
        {
          gender: "FEMALE",
          roommateGenderPreference: "FEMALE",
        },
      );

      expect(result).toBe(false);
    });

    it("양쪽이 성별 무관이면 서로 다른 성별도 매칭된다", () => {
      const result = isMutuallyGenderCompatible(
        {
          gender: "MALE",
          roommateGenderPreference: "ANY",
        },
        {
          gender: "FEMALE",
          roommateGenderPreference: "ANY",
        },
      );

      expect(result).toBe(true);
    });

    it("기존 OTHER 사용자는 양쪽이 성별 무관일 때만 매칭된다", () => {
      expect(
        isMutuallyGenderCompatible(
          {
            gender: "OTHER",
            roommateGenderPreference: "ANY",
          },
          {
            gender: "MALE",
            roommateGenderPreference: "ANY",
          },
        ),
      ).toBe(true);

      expect(
        isMutuallyGenderCompatible(
          {
            gender: "OTHER",
            roommateGenderPreference: "ANY",
          },
          {
            gender: "MALE",
            roommateGenderPreference: "FEMALE",
          },
        ),
      ).toBe(false);
    });
  });

  describe("resolveVisibleGender", () => {
    it("PUBLIC은 성별을 전체 공개한다", () => {
      expect(resolveVisibleGender("MALE", "PUBLIC", false)).toBe("MALE");
    });

    it("MATCHED_ONLY는 매칭 사용자에게만 공개한다", () => {
      expect(resolveVisibleGender("FEMALE", "MATCHED_ONLY", true)).toBe(
        "FEMALE",
      );

      expect(resolveVisibleGender("FEMALE", "MATCHED_ONLY", false)).toBeNull();
    });

    it("PRIVATE은 매칭 여부와 관계없이 공개하지 않는다", () => {
      expect(resolveVisibleGender("MALE", "PRIVATE", true)).toBeNull();

      expect(resolveVisibleGender("MALE", "PRIVATE", false)).toBeNull();
    });

    it("기존 OTHER 성별은 PUBLIC이어도 공개하지 않는다", () => {
      expect(resolveVisibleGender("OTHER", "PUBLIC", true)).toBeNull();
    });
  });
});
