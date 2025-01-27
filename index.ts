// const axios = require("axios");
import axios from "axios";
import JSSoup from "jssoup";
import { normalizeDescription } from "./krasnodarParser";
const baseUrl = "https://priut.ru";

export type Animal = {
  name: string;
  description: string;
  photos: string[];
  size: "M" | "L" | "S";
  type: "dog" | "cat";
  gender: boolean;
  age: "baby" | "adult" | "young";
  url: string;
};

const animalType = {
  Кот: "cat",
  Кошка: "cat",
  Сука: "dog",
  Кобель: "dog",
};
const parseAge = (age: string) => {
  const startIndex = age.indexOf("(") + 1;
  const endIndex = age.indexOf(")");
  const date = age.substring(startIndex, endIndex).trim();
  return date;
};
const handleAge = (age: string): Animal["age"] => {
  const parsedAge = parseAge(age);
  const [day, month, year] = parsedAge.split(".").map(Number);
  const date = new Date(year, month - 1, day);
  const now = new Date();
  const ageInYears = now.getFullYear() - date.getFullYear();
  if (ageInYears > 8) {
    return "adult";
  }
  if (ageInYears > 4) {
    return "young";
  }
  return "baby";
};

export const getSize = (size: number): Animal["size"] => {
  if (size > 50) {
    return "L";
  }

  if (size > 30) {
    return "M";
  }
  return "S";
};

const parseWebsite = async (page: number) => {
  const mainArray: Animal[] = [];
  try {
    const response = await axios.get(baseUrl + `/catalog/pets?page=${page}`);
    const parser = new JSSoup(response.data);
    const targetDiv = parser.findAll("a", {
      class: "pet-card",
    });

    if (!targetDiv.length) {
      return mainArray;
    }

    const promises = [];
    for (let index = 0; index < targetDiv.length; index++) {
      const element = targetDiv[index];
      const attrs = element.attrs.href;
      promises.push(parsePagePet(attrs));
    }
    const resp = await Promise.allSettled<{
      value: string;
    }>(promises);
    const animals = resp
      .filter((pet) => pet.status === "fulfilled")
      .map((el) => el.value);
    mainArray.push(...(animals as unknown as Animal[]));
    const nextAnimals = await parseWebsite(page + 1);
    mainArray.push(...nextAnimals);
  } catch (error) {
    console.log("ERRROR", error);
  }
  return mainArray;
};
// parseWebsite(0).then((el) => console.log(el[el.length - 1]));

const parsePagePet = async (url: string) => {
  const animal: Partial<Animal> = {};
  try {
    const response = await axios.get(url);
    const parserPage = new JSSoup(response.data);
    const tegs = parserPage.findAll("p", {
      class: "p",
    });
    const description = parserPage.find("p", {
      class: "mb-32",
    });
    const name = parserPage.find("h1", {
      class: "h1",
    });

    const images = parserPage.findAll("img", {
      class: "slider__img",
    });
    const photos = images.reduce((acc, el, index) => {
      const img = el.attrs.src;
      console.log("img", img);
      if (!img.startsWith("https") && !img.includes("preview")) {
        if (acc.length > 6) {
          return acc;
        }
        acc.push(baseUrl + img);
      }
      return acc;
    }, []);

    animal["name"] = name.getText().trim();
    animal["gender"] = tegs[8].getText() === "Сука" ? false : true;
    animal["age"] = handleAge(tegs[10].getText());
    animal["size"] = getSize(+tegs[11].getText().slice(0, 2));
    animal["description"] = normalizeDescription(description.getText().trim());
    animal["type"] = animalType[tegs[8].getText()];
    animal["photos"] = photos;
    animal["url"] = url;
    return animal;
  } catch (error) {
    console.log("ERRROR", error);
  }
};
