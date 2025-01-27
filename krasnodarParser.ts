import axios from "axios";
import JSSoup from "jssoup";
import { Animal, getSize } from ".";
const baseUrl = "https://krasnodog.ru";

const genderMap = {
  мальчик: true,
  девочка: false,
};

export function normalizeDescription(description: string) {
  const withSpaces = description.replace(/<br\s*\/?>/gi, " ");

  const withoutTags = withSpaces.replace(/<[^>]*>/g, "");

  const withoutNbsp = withoutTags.replace(/&nbsp;/g, " ");

  return withoutNbsp.replace(/\s+/g, " ").trim();
}
const getPetType = (url: string) => {
  if (url.includes("sobaki")) return "dog";
  return "cat";
};
const getParsedAge = (age: string) => {
  const newAge = age.trim().split(" ");
  const [ageNumber, _, type] = newAge;
  if (type.startsWith("год")) {
    return "baby";
  }
  if (+ageNumber > 4) {
    return "young";
  }
  if (+ageNumber > 10) {
    return "adult";
  }
  return "baby";
};

let firstPage = "";
const parseUrl = async (page: number) => {
  const mainArray: Animal[] = [];
  try {
    const response = await axios.get(baseUrl + `/zhivotnyie/?page=${page}`);
    const parserPage = new JSSoup(response.data);
    const targetDiv = parserPage.find();
    const div = targetDiv.findAll("a", {
      class: "animal-card__img",
    });
    if (firstPage === div[0].attrs.href) return mainArray;
    firstPage = firstPage ? firstPage : div[0].attrs.href;
    const promises = [];
    for (let index = 0; index < div.length; index++) {
      const element = div[index];
      const attrs = element.attrs.href;

      promises.push(parsePetPage(attrs));
    }

    const resp = await Promise.allSettled<{
      value: string;
    }>(promises);
    const animals = resp
      .filter((pet) => pet.status === "fulfilled")
      .map((el) => el.value);
    mainArray.push(...(animals as unknown as Animal[]));

    const nextAnimals = await parseUrl(page + 1);
    mainArray.push(...nextAnimals);
  } catch (error) {}
  return mainArray;
};

const parsePetPage = async (url: string) => {
  const animal: Partial<Animal> = {};
  const page = await axios.get(url);
  const pet = new JSSoup(page.data);
  const description = pet.find("p");
  const name = pet.find("h1", {
    class: "animal__content-title",
  });

  const allDivs = pet.findAll("dd");
  const photoTags = pet.findAll("img");

  const photos = photoTags.reduce((acc, currentValue) => {
    if (acc.length > 6) {
      return acc;
    }
    const photo = currentValue.attrs.src;
    if (photo?.startsWith("/assets")) {
      acc.push(baseUrl + photo);
    }
    return acc;
  }, []);
  animal.name = name.getText();
  animal.gender = genderMap[allDivs[3].getText().trim()];
  animal.age = getParsedAge(allDivs[0].getText());
  animal.type = getPetType(url);
  animal.url = url;
  animal.photos = photos;
  animal.size = getSize(+allDivs[7].getText().slice(0, 2));
  animal.description = normalizeDescription(description.getText().trim());
};

parseUrl(1).then((res) => console.log(res.length));
